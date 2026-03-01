import api from './api'
import type { Product, CreateProduct, UpdateProduct } from '@/types'

export const productsService = {
  getProducts: (roomId: string) =>
    api.get<Product[]>(`/rooms/${roomId}/products`).then((r) => r.data),

  getProduct: (id: string) =>
    api.get<Product>(`/products/${id}`).then((r) => r.data),

  createProduct: (data: CreateProduct) =>
    api.post<Product>('/products', data).then((r) => r.data),

  updateProduct: (id: string, data: Partial<UpdateProduct>) =>
    api.patch<Product>(`/products/${id}`, data).then((r) => r.data),

  deleteProduct: (id: string) =>
    api.delete(`/products/${id}`).then((r) => r.data),

  conformToShape: (id: string, shapeData: unknown) =>
    api.post<Product>(`/products/${id}/conform`, shapeData).then((r) => r.data),

  saveToLibrary: (id: string, name?: string) =>
    api.post(`/products/${id}/save-to-library`, { name }).then((r) => r.data),

  getLibrary: (params?: { type?: string; search?: string }) =>
    api.get<Product[]>('/products/library', { params }).then((r) => r.data),
}
