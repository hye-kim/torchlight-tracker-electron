import ExcelJS from 'exceljs';
import { FileManager } from './FileManager';
import { Logger } from './Logger';

const logger = Logger.getInstance();

export interface DropRecord {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  timestamp: number;
}

export class ExcelExporter {
  constructor(private fileManager: FileManager) {}

  async exportDropsToExcel(
    drops: DropRecord[],
    filePath: string,
    applyTax: boolean = false
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Drops');

      // Define columns
      worksheet.columns = [
        { header: 'Time', key: 'time', width: 20 },
        { header: 'Item Name', key: 'name', width: 35 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8B5CF6' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Add data rows
      for (const drop of drops) {
        const taxMultiplier = applyTax ? 0.875 : 1.0; // 12.5% tax
        const effectivePrice = drop.price * taxMultiplier;
        const totalValue = effectivePrice * drop.quantity;

        worksheet.addRow({
          time: new Date(drop.timestamp).toLocaleString(),
          name: drop.name,
          type: drop.type || 'Unknown',
          quantity: drop.quantity,
          unitPrice: effectivePrice.toFixed(2),
          totalValue: totalValue.toFixed(2),
        });
      }

      // Add summary row
      const summaryRowIndex = drops.length + 3;
      worksheet.getCell(`A${summaryRowIndex}`).value = 'Total Items:';
      worksheet.getCell(`B${summaryRowIndex}`).value = drops.length;
      worksheet.getCell(`A${summaryRowIndex + 1}`).value = 'Total Value (FE):';
      worksheet.getCell(`B${summaryRowIndex + 1}`).value = {
        formula: `SUM(F2:F${drops.length + 1})`,
      };

      // Style summary
      worksheet.getCell(`A${summaryRowIndex}`).font = { bold: true };
      worksheet.getCell(`A${summaryRowIndex + 1}`).font = { bold: true };
      worksheet.getCell(`B${summaryRowIndex + 1}`).font = { bold: true, color: { argb: 'FF10B981' } };

      // Add borders to all cells
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF4A4A5E' } },
            left: { style: 'thin', color: { argb: 'FF4A4A5E' } },
            bottom: { style: 'thin', color: { argb: 'FF4A4A5E' } },
            right: { style: 'thin', color: { argb: 'FF4A4A5E' } },
          };
        });
      });

      // Save workbook
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Excel exported successfully to: ${filePath}`);
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      throw error;
    }
  }
}
