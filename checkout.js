"use strict";

const byId = id => document.getElementById(id);
const formatMoney = new Intl.NumberFormat("en-GH", {style:"currency", currency:"GHS"});
const productIndex = new Map(products.map(product => [product.id, product]));
const form = byId("checkoutForm");
const lines = byId("lines");
const review = byId("review");
const requestText = byId("orderText");
const whatsapp = byId("whatsapp");
const fallback = productIndex.get(new URLSearchParams(location.search).get("item"));
let basket = getBasket();

if (!basket.length && fallback && fallback.stock !== false) {
  basket = [{id:fallback.id, quantity:1}];
  saveBasket(basket);
  history.replaceState(null, "", location.pathname);
}

function hideReview() {
  review.hidden = true;
  requestText.value = "";
  whatsapp.removeAttribute("href");
  byId("copyStatus").textContent = "";
}

function renderOrder() {
  lines.replaceChildren();
  byId("emptyBasket").hidden = basket.length > 0;
  byId("totals").hidden = !basket.length;
  byId("reviewButton").disabled = !basket.length;

  let subtotal = 0;
  for (const item of basket) {
    const product = productIndex.get(item.id);
    const row = document.createElement("div");
    row.className = "line";
    const image = document.createElement("img");
    image.src = product.photos[0].src;
    image.alt = "";
    image.addEventListener("error", () => { image.style.visibility = "hidden"; });
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const price = document.createElement("p");
    if (typeof product.price === "number") {
      const total = product.price * item.quantity;
      subtotal += total;
      price.textContent = formatMoney.format(total) + " estimated";
    } else {
      price.textContent = "Price on request";
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + product.name);
    remove.addEventListener("click", () => {
      basket = basket.filter(line => line.id !== item.id);
      saveBasket(basket);
      hideReview();
      renderOrder();
      byId("basketStatus").textContent = product.name + " removed.";
    });
    const label = document.createElement("label");
    label.className = "quantity";
    label.textContent = "Qty";
    const quantity = document.createElement("input");
    Object.assign(quantity, {type:"number", min:1, max:999, step:1, value:item.quantity, required:true});
    quantity.setAttribute("aria-label", "Quantity for " + product.name);
    quantity.addEventListener("input", hideReview);
    quantity.addEventListener("change", () => {
      const value = quantity.valueAsNumber;
      if (!quantity.checkValidity()) {
        quantity.value = item.quantity;
        byId("basketStatus").textContent = "Enter a quantity from 1 to 999.";
        return;
      }
      item.quantity = value;
      saveBasket(basket);
      renderOrder();
      byId("basketStatus").textContent = "Quantity updated.";
    });
    label.append(quantity);
    info.append(name, price, remove);
    row.append(image, info, label);
    lines.append(row);
  }

  byId("subtotal").textContent = basket.some(item => typeof productIndex.get(item.id).price === "number")
    ? formatMoney.format(subtotal) : "Quote required";
}

function syncDelivery() {
  const method = byId("method").value;
  const delivery = byId("deliveryFields");
  delivery.hidden = method !== "delivery";
  delivery.querySelectorAll("input, textarea").forEach(field => { field.disabled = delivery.hidden; });
  byId("pickupNote").hidden = method !== "pickup";
}

const phone = form.elements.namedItem("phone");
function validatePhone() {
  const value = phone.value.trim();
  const digits = value.replace(/\D/g, "").length;
  phone.setCustomValidity(!value || (/^\+?[\d ()-]+$/.test(value) && digits >= 7 && digits <= 15)
    ? "" : "Enter a valid phone number.");
}
phone.addEventListener("input", validatePhone);
form.addEventListener("input", hideReview);
byId("method").addEventListener("change", syncDelivery);
form.addEventListener("submit", event => {
  event.preventDefault();
  validatePhone();
  if (!basket.length || !form.reportValidity()) return;

  const data = new FormData(form);
  const value = name => (data.get(name) || "").trim();
  const request = [
    "Hello Dek450 Medsupplies. I'd like to request the following order.", "", "Items",
    ...basket.map(item => {
      const product = productIndex.get(item.id);
      const price = typeof product.price === "number"
        ? formatMoney.format(item.quantity * product.price) + " estimated" : "quote requested";
      return "- " + item.quantity + " × " + product.name + " (" + price + ")";
    }),
    "Estimated subtotal: " + byId("subtotal").textContent,
    "", "Customer: " + value("name"), "Phone: " + value("phone")
  ];

  if (value("email")) request.push("Email: " + value("email"));
  if (value("company")) request.push("Facility/company: " + value("company"));
  if (value("method") === "delivery") {
    request.push("", "Fulfilment: Delivery", "Address: " + [value("address"),value("city"),value("region")].join(", "));
    if (value("directions")) request.push("Delivery instructions: " + value("directions"));
  } else {
    request.push("", "Fulfilment: Pickup");
  }
  if (value("notes")) request.push("Order requirements: " + value("notes"));
  request.push("", "Please confirm stock, final prices, and fulfilment arrangements.");
  requestText.value = request.join("\n");
  whatsapp.href = "https://wa.me/233533805134?text=" + encodeURIComponent(requestText.value);
  review.hidden = false;
  byId("reviewHeading").focus();
});

byId("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(requestText.value);
    byId("copyStatus").textContent = "Request copied.";
  } catch {
    requestText.focus();
    requestText.select();
    byId("copyStatus").textContent = "Request selected. Use your device’s copy command.";
  }
});

syncDelivery();
renderOrder();
