import type { CartLine } from "../data";

type NewLine = { productId: string; name: string; unitPrice: number };

export function addToCart(cart: CartLine[], line: NewLine): CartLine[] {
	const existing = cart.find((l) => l.productId === line.productId);
	if (existing) {
		return cart.map((l) =>
			l.productId === line.productId ? { ...l, quantity: l.quantity + 1 } : l,
		);
	}
	return [...cart, { ...line, quantity: 1 }];
}

export function setQty(
	cart: CartLine[],
	productId: string,
	quantity: number,
): CartLine[] {
	if (quantity <= 0) return removeFromCart(cart, productId);
	return cart.map((l) => (l.productId === productId ? { ...l, quantity } : l));
}

export function removeFromCart(
	cart: CartLine[],
	productId: string,
): CartLine[] {
	return cart.filter((l) => l.productId !== productId);
}

export function cartTotal(cart: CartLine[]): number {
	return cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function toOrderItems(
	cart: CartLine[],
): { productId: string; quantity: number }[] {
	return cart.map((l) => ({ productId: l.productId, quantity: l.quantity }));
}
