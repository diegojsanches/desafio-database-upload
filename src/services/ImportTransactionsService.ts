import fs from 'fs';
import parse from 'csv-parse';
import { getRepository, getCustomRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import CreateCategoryService from './CreateCategoryService';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CreateTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const fileStreamCSV = fs.createReadStream(filePath);
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const transactions: Transaction[] = [];
    const parser = parse({ from_line: 2 });
    const parsedCSV = fileStreamCSV.pipe(parser);
    const transactionsCSV: CreateTransaction[] = [];
    const categoriesCSV: string[] = [];

    parsedCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      transactionsCSV.push({ title, type, value, category });
      categoriesCSV.push(category);
    });
    await new Promise(resolve => parsedCSV.on('end', resolve));

    const categoriesRepository = getRepository(Category);
    const createCategoryService = new CreateCategoryService();

    const existentCategories = await categoriesRepository.find({
      where: { title: In(categoriesCSV) },
    });

    const existentCategoriesTitle = existentCategories.map(
      (category: Category) => category.title,
    );

    await Promise.all(
      categoriesCSV
        .filter(
          (category, index, self) =>
            !existentCategoriesTitle.includes(category) &&
            self.indexOf(category) === index,
        )
        .map(async category => {
          await createCategoryService.execute({ title: category });
        }),
    );

    await Promise.all(
      transactionsCSV.map(async transaction => {
        const category = await categoriesRepository.findOne({
          where: { title: transaction.category },
        });
        transactions.push({
          ...transaction,
          category,
        } as Transaction);
      }),
    );

    transactionsRepository.create(transactions);

    await transactionsRepository.save(transactions);

    await fs.promises.unlink(filePath);

    return transactions;
  }
}

export default ImportTransactionsService;
