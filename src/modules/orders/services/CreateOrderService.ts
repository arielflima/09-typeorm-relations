import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer id not exists', 404);
    }

    const idOfProducts = products.map(product => ({ id: product.id }));

    const productsWithPrice = await this.productsRepository.findAllById(
      idOfProducts,
    );

    if (products.length !== productsWithPrice.length) {
      throw new AppError(`There's one or more nonexistent products`, 404);
    }

    products.forEach(product => {
      const stockQuantity = productsWithPrice.find(
        ({ id }) => id === product.id,
      )?.quantity;

      if ((stockQuantity || 0) < product.quantity) {
        throw new AppError('Quantity unavaible in stock');
      }
    });

    const productsToOrdersRepository = products.map(product => ({
      product_id: product.id,
      price: productsWithPrice.find(({ id }) => id === product.id)?.price || 0,
      quantity: product.quantity,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: productsToOrdersRepository,
    });

    await this.productsRepository.updateQuantity(products);

    console.log(order);

    return order;
  }
}

export default CreateOrderService;
