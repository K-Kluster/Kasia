import { FC, useEffect, useState } from 'react';
import { formatKasAmount } from '../utils/format';
import { useWalletStore } from '../store/wallet.store';

interface FeeBucketsProps {
  inline?: boolean;
}

// Standard transaction mass in grams (typical Kaspa transaction)
const STANDARD_TRANSACTION_MASS = 2036;

// Convert Sompi to KAS
const sompiToKas = (sompi: number): number => {
  return sompi / 100_000_000;
};

/**
 * Fee bucket component that displays network fee rate estimates
 */
export const FeeBuckets: FC<FeeBucketsProps> = ({ inline = false }) => {
  const rpcClient = useWalletStore((s) => s.rpcClient);
  const [feeEstimate, setFeeEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeeEstimates = async () => {
      if (!rpcClient?.rpc) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get fee estimates from RPC client
        const result = await rpcClient.rpc.getFeeEstimate();
        console.log('Fee estimates raw response:', result);
        
        // Store the entire response for debugging
        setFeeEstimate(result);
      } catch (err) {
        console.error('Failed to fetch fee estimates:', err);
        setError('Failed to fetch fee estimates');
      } finally {
        setLoading(false);
      }
    };

    fetchFeeEstimates();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchFeeEstimates, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [rpcClient]);

  if (loading && !feeEstimate) {
    return inline ? null : (
      <div className="fee-buckets">
        <h4>Network Fees</h4>
        <div className="loading">Loading fee estimates...</div>
      </div>
    );
  }

  if (error && !feeEstimate) {
    return inline ? null : (
      <div className="fee-buckets">
        <h4>Network Fees</h4>
        <div className="error">{error}</div>
      </div>
    );
  }

  // Early return if no estimate available
  if (!feeEstimate) return null;
  
  // Get the estimate from the response
  const estimate = feeEstimate.estimate || {};

  // Helper function to calculate actual fee from fee rate and format as KAS
  const calculateAndFormatFee = (feeRate: number): string => {
    const feeInSompi = Math.ceil(feeRate * STANDARD_TRANSACTION_MASS);
    const feeInKas = sompiToKas(feeInSompi);
    return formatKasAmount(feeInKas);
  };

  // Helper function to safely format time
  const formatTime = (seconds: any) => {
    if (seconds === undefined || seconds === null) return 'N/A';
    const value = Number(seconds);
    if (isNaN(value)) return 'N/A';

    // Handle different time scales
    if (value < 0.001) {
      return `~0.1s`; // Show as ~0.1s like explorer
    } else if (value < 1) {
      return `~${(value * 1000).toFixed(0)}ms`;
    } else if (value < 60) {
      return `~${value.toFixed(1)}s`;
    } else {
      return `~${Math.round(value / 60)}m`;
    }
  };

  // For inline display, show all three buckets in a compact format
  if (inline) {
    return (
      <div className="fee-buckets-inline">
        {estimate.priorityBucket && (
          <div 
            className="fee-rate-inline priority" 
            title={`Fast - Time: ${formatTime(estimate.priorityBucket.estimatedSeconds)} - Fee: ${calculateAndFormatFee(estimate.priorityBucket.feerate)} KAS`}
          >
            <span className="fee-label">P:</span>
            <span className="fee-value">{calculateAndFormatFee(estimate.priorityBucket.feerate)}</span>
          </div>
        )}
        {estimate.normalBuckets && estimate.normalBuckets.length > 0 && (
          <div 
            className="fee-rate-inline normal" 
            title={`Normal - Time: ${formatTime(estimate.normalBuckets[0]?.estimatedSeconds)} - Fee: ${calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)} KAS`}
          >
            <span className="fee-label">N:</span>
            <span className="fee-value">{calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)}</span>
          </div>
        )}
        {estimate.lowBuckets && estimate.lowBuckets.length > 0 && (
          <div 
            className="fee-rate-inline low" 
            title={`Slow - Time: ${formatTime(estimate.lowBuckets[0]?.estimatedSeconds)} - Fee: ${calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)} KAS`}
          >
            <span className="fee-label">L:</span>
            <span className="fee-value">{calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fee-buckets">
      <h4>Network Fees</h4>
      
      {estimate.priorityBucket && (
        <div className="fee-bucket priority">
          <div className="fee-bucket-header">Fast</div>
          <div className="fee-bucket-rate">
            {calculateAndFormatFee(estimate.priorityBucket.feerate)} KAS
          </div>
          <div className="fee-bucket-time">
            {formatTime(estimate.priorityBucket.estimatedSeconds)}
          </div>
        </div>
      )}
      
      {estimate.normalBuckets && estimate.normalBuckets.length > 0 && (
        <div className="fee-bucket normal">
          <div className="fee-bucket-header">Normal</div>
          <div className="fee-bucket-rate">
            {calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)} KAS
          </div>
          <div className="fee-bucket-time">
            {formatTime(estimate.normalBuckets[0]?.estimatedSeconds)}
          </div>
        </div>
      )}
      
      {estimate.lowBuckets && estimate.lowBuckets.length > 0 && (
        <div className="fee-bucket low">
          <div className="fee-bucket-header">Slow</div>
          <div className="fee-bucket-rate">
            {calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)} KAS
          </div>
          <div className="fee-bucket-time">
            {formatTime(estimate.lowBuckets[0]?.estimatedSeconds)}
          </div>
        </div>
      )}

      <div className="fee-buckets-info">
        <small>Fees calculated for standard transaction size ({STANDARD_TRANSACTION_MASS} grams)</small>
      </div>
    </div>
  );
}; 