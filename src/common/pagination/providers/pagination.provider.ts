import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { FindManyOptions, ObjectLiteral, Repository } from 'typeorm';
import { PaginationQueryDto } from '../dtos/pagination-query.dto';
import { Request } from 'express';
import { Paginated } from '../interfaces/paginated.interface';

@Injectable()
export class PaginationProvider {
  constructor(
    /**
     * Injecting request
     */
    @Inject(REQUEST)
    private readonly request: Request,
  ) {}

  // public async paginateQuery<T extends ObjectLiteral>(
  //   paginationQuery: PaginationQueryDto | any,
  //   repository: Repository<T>,
  //   findOptions?: FindManyOptions<T>,
  // ): Promise<Paginated<T>> {
  //   let results = await repository.find({
  //     skip: (paginationQuery.page - 1) * paginationQuery.limit,
  //     take: paginationQuery.limit,
  //     ...findOptions,
  //   });

  //   /**
  //    * create the request URLS
  //    */
  //   const baseURL =
  //     this.request.protocol + '://' + this.request.headers.host + '/';
  //   const newURL = new URL(this.request.url, baseURL);

  //   /**
  //    * calculating Pages
  //    */
  //   const totalItems = await repository.count();
  //   const totalPages = Math.ceil(totalItems / paginationQuery.limit);
  //   const nextPage =
  //     paginationQuery.page === totalPages
  //       ? paginationQuery.page
  //       : paginationQuery.page + 1;
  //   const previousPage =
  //     paginationQuery.page === 1
  //       ? paginationQuery.page
  //       : paginationQuery.page - 1;

  //   const finalResponse: Paginated<T> = {
  //     data: results,
  //     meta: {
  //       itemsPerPage: paginationQuery.limit,
  //       totalItems: totalItems,
  //       currentPage: paginationQuery.page,
  //       totalPages: totalPages,
  //     },
  //     links: {
  //       first: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=1`,
  //       last: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${totalPages}`,
  //       current: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${paginationQuery.page}`,
  //       next: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${nextPage}`,
  //       previous: `${newURL.origin}${newURL.pathname}?limit=${paginationQuery.limit}&page=${previousPage}`,
  //     },
  //   };

  //   return finalResponse;
  // }

  public async paginateQuery<T extends ObjectLiteral>(
    paginationQuery: PaginationQueryDto,
    repository: Repository<T>,
    findOptions?: FindManyOptions<T>,
  ): Promise<Paginated<T>> {
    const page = Number(paginationQuery.page) || 1;
    const limit = Number(paginationQuery.limit) || 10;

    const [results, totalItems] = await repository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      ...findOptions,
    });

    /**
     * create the request URLS
     */
    const baseURL =
      this.request.protocol + '://' + this.request.headers.host + '/';
    const newURL = new URL(this.request.url, baseURL);

    /**
     * calculating Pages
     */
    const totalPages = Math.ceil(totalItems / limit);

    const nextPage = page >= totalPages ? totalPages : page + 1;

    const previousPage = page <= 1 ? 1 : page - 1;

    const finalResponse: Paginated<T> = {
      data: results,
      meta: {
        itemsPerPage: limit,
        totalItems: totalItems,
        currentPage: page,
        totalPages: totalPages,
      },
      links: {
        first: `${newURL.origin}${newURL.pathname}?limit=${limit}&page=1`,
        last: `${newURL.origin}${newURL.pathname}?limit=${limit}&page=${totalPages}`,
        current: `${newURL.origin}${newURL.pathname}?limit=${limit}&page=${page}`,
        next: `${newURL.origin}${newURL.pathname}?limit=${limit}&page=${nextPage}`,
        previous: `${newURL.origin}${newURL.pathname}?limit=${limit}&page=${previousPage}`,
      },
    };

    return finalResponse;
  }
}
