import { JsonRpcProvider } from 'ethers';

// Browser-visible by design: restrict provider keys to your app's domains.
const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.ethpandaops.io';
export const provider = new JsonRpcProvider(rpcUrl, 11155111);
export const explorer = 'https://sepolia.etherscan.io';
