/**
 * Sorts transactions chronologically to ensure FIFO lot matching behaves correctly.
 * If dates are identical, Buy transactions are processed before Sell transactions
 * so that open lots are created before they are deducted.
 */
export function sortTransactions(transactions: any[]): any[] {
  return [...transactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    const typeA = a.type || 'Buy';
    const typeB = b.type || 'Buy';
    if (typeA === typeB) return 0;
    return typeA === 'Buy' ? -1 : 1;
  });
}
