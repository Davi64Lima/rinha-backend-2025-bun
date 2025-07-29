type Summary = {
    totalAmount: number;
    processed: number;
    failed: number;
  };
  
  const summary: Summary = {
    totalAmount: 0,
    processed: 0,
    failed: 0,
  };
  
  export const addToSummary = (amount: number) => {
    summary.totalAmount += amount;
    summary.processed++;
  }
  
  export const incrementFailed = () => {
    summary.failed++;
  }
  
  export const getSummary = (): Summary => {
    return summary;
  }
  