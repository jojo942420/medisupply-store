"use strict";

const basketKey = "dek450-basket-v1";

function getBasket() {
  try {
    const saved = JSON.parse(localStorage.getItem(basketKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(line =>
      line && products.some(product => product.id === line.id && product.stock !== false) &&
      Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 999
    );
  } catch {
    return [];
  }
}

function saveBasket(basket) {
  try {
    localStorage.setItem(basketKey, JSON.stringify(basket));
    return true;
  } catch {
    return false;
  }
}
