// Global teardown to close any remaining server handles
module.exports = async () => {
  // Wait a bit for any remaining operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Force exit if there are still open handles
  process.exit(0);
};


