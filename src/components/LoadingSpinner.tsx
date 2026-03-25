import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

function LoadingSpinner({ size = 'medium', className = '' }: LoadingSpinnerProps): JSX.Element {
  return (
    <div className={`loading-spinner loading-spinner-${size} ${className}`} role="status">
      <svg className="spinner" viewBox="0 0 50 50">
        <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export default LoadingSpinner;
