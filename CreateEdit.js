/*This file is to illustrate the idea of how to differntiate between
  the object if it is a new object or it is an existing object has to 
  be updated.
*/
// ✅ Full Class Example (Browser + localStorage)
import { v4 as uuidv4 } from 'uuid';

class Product {
  constructor(name, price, id = null) {
    this.id = id ?? uuidv4();
    this.name = name;
    this.price = price;

    this.isNew = id === null;
  }

  // Helper: read all products
  static loadAll() {
    const data = localStorage.getItem('products');
    return data ? JSON.parse(data) : [];
  }

  // Helper: save full array back to storage
  static saveAll(products) {
    localStorage.setItem('products', JSON.stringify(products));
  }

  // INSERT or UPDATE
  save() {
    const products = Product.loadAll();

    if (this.isNew) {
      // INSERT
      products.push({
        id: this.id,
        name: this.name,
        price: this.price,
      });
      this.isNew = false; // now it’s saved
    } else {
      // UPDATE (find by ID)
      const index = products.findIndex(p => p.id === this.id);
      if (index !== -1) {
        products[index] = {
          id: this.id,
          name: this.name,
          price: this.price,
        };
      }
    }

    Product.saveAll(products);
  }

  // Static loader to load an object back into class form
  static load(id) {
    const products = Product.loadAll();
    const data = products.find(p => p.id === id);

    if (!data) return null;

    return new Product(data.name, data.price, data.id); // id → not new
  }

  delete() {
    const products = Product.loadAll();
    const updated = products.filter(p => p.id !== this.id);
    Product.saveAll(updated);
  }
}
//////////////////////////////////////////////////////////////////////
// ✅ Example: Saving through a REST API (your C# backend)

import { v4 as uuidv4 } from 'uuid';

class Product {
  constructor(name, price, id = null) {
    this.id = id ?? uuidv4();
    this.name = name;
    this.price = price;

    this.isNew = id === null;
  }

  // Automatic save method
  async save() {
    const payload = {
      id: this.id,
      name: this.name,
      price: this.price,
    };

    if (this.isNew) {
      // INSERT (POST)
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Insert failed');
      this.isNew = false; // now it’s no longer new
      return await response.json();
    } else {
      // UPDATE (PUT)
      const response = await fetch(`/api/products/${this.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Update failed');
      return await response.json();
    }
  }
}
