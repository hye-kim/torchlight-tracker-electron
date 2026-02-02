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
    costs: DropRecord[],
    filePath: string,
    applyTax: boolean = false
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Drops');

      // Define columns for drops table
      worksheet.columns = [
        { header: 'Time', key: 'time', width: 20 },
        { header: 'Item Name', key: 'name', width: 35 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit Price', key: 'unitPrice', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
      ];

      // Style header row for drops
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF8B5CF6' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Add drops data rows
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        const taxMultiplier = applyTax ? 0.875 : 1.0; // 12.5% tax
        const effectivePrice = drop.price * taxMultiplier;
        const rowNum = i + 2; // Excel row number (1-indexed, starting after header)

        const row = worksheet.addRow({
          time: new Date(drop.timestamp).toLocaleString(),
          name: drop.name,
          type: drop.type || 'Unknown',
          quantity: drop.quantity,
          unitPrice: effectivePrice,
          totalValue: null, // Will be filled with formula
        });

        // Set formula for total value (quantity * unit price)
        worksheet.getCell(`F${rowNum}`).value = { formula: `D${rowNum}*E${rowNum}` };

        // Format unit price and total value as numbers with 2 decimal places
        worksheet.getCell(`E${rowNum}`).numFmt = '0.00';
        worksheet.getCell(`F${rowNum}`).numFmt = '0.00';
      }

      // Add costs table
      const costsStartRow = drops.length + 4; // Leave a blank row after drops

      // Add costs header
      worksheet.getCell(`A${costsStartRow}`).value = 'COSTS';
      worksheet.getCell(`A${costsStartRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getCell(`A${costsStartRow}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' }, // Red background
      };
      worksheet.getCell(`A${costsStartRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

      // Merge cells for costs header
      worksheet.mergeCells(`A${costsStartRow}:F${costsStartRow}`);

      const costsHeaderRow = costsStartRow + 1;
      ['Time', 'Item Name', 'Type', 'Quantity', 'Unit Price', 'Total Cost'].forEach((header, idx) => {
        const cell = worksheet.getCell(costsHeaderRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF4444' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Add costs data rows
      for (let i = 0; i < costs.length; i++) {
        const cost = costs[i];
        const taxMultiplier = applyTax ? 0.875 : 1.0; // 12.5% tax
        const effectivePrice = cost.price * taxMultiplier;
        const rowNum = costsHeaderRow + 1 + i;

        const row = worksheet.addRow({
          time: new Date(cost.timestamp).toLocaleString(),
          name: cost.name,
          type: cost.type || 'Unknown',
          quantity: cost.quantity,
          unitPrice: effectivePrice,
          totalValue: null, // Will be filled with formula
        });

        // Set formula for total cost (quantity * unit price)
        worksheet.getCell(`F${rowNum}`).value = { formula: `D${rowNum}*E${rowNum}` };

        // Format unit price and total cost as numbers with 2 decimal places
        worksheet.getCell(`E${rowNum}`).numFmt = '0.00';
        worksheet.getCell(`F${rowNum}`).numFmt = '0.00';
      }

      // Add summary row for total value (drops - costs)
      const summaryRowIndex = costsHeaderRow + costs.length + 3;
      const dropsEndRow = drops.length + 1;
      const costsEndRow = costsHeaderRow + costs.length;

      worksheet.getCell(`A${summaryRowIndex}`).value = 'Total Value (FE):';
      worksheet.getCell(`A${summaryRowIndex}`).font = { bold: true };

      // Calculate total value as sum of drops - sum of costs
      const dropsFormula = drops.length > 0 ? `SUM(F2:F${dropsEndRow})` : '0';
      const costsFormula = costs.length > 0 ? `SUM(F${costsHeaderRow + 1}:F${costsEndRow})` : '0';

      worksheet.getCell(`B${summaryRowIndex}`).value = {
        formula: `${dropsFormula}-${costsFormula}`,
      };
      worksheet.getCell(`B${summaryRowIndex}`).font = { bold: true, color: { argb: 'FF10B981' } };
      worksheet.getCell(`B${summaryRowIndex}`).numFmt = '0.00';

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
