import fs from 'fs';
import csv from 'csvtojson';
import Transaction from '../models/Transaction';
import CreateTransactionService from './CreateTransactionService';

interface Request {
  file: string;
}

interface CreateTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute({ file }: Request): Promise<Transaction[]> {
    const transactionsCSV: CreateTransaction[] = await csv().fromFile(file);
    const createTransactionService = new CreateTransactionService();
    const transactions: Transaction[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const item in transactionsCSV) {
      if (Object.prototype.hasOwnProperty.call(transactionsCSV, item)) {
        transactions.push(
          // eslint-disable-next-line no-await-in-loop
          await createTransactionService.execute(transactionsCSV[item]),
        );
      }
    }

    await fs.promises.unlink(file);

    return transactions;
  }
}

export default ImportTransactionsService;
