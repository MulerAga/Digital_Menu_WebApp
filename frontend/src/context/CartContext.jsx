import { createContext, useContext, useReducer } from 'react';

const CartContext = createContext();

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return { ...state, items: state.items.map((i) => i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i) };
      }
      return { ...state, items: [...state.items, { ...action.item, qty: 1 }] };
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'UPDATE_QTY':
      if (action.qty <= 0) return { ...state, items: state.items.filter((i) => i.id !== action.id) };
      return { ...state, items: state.items.map((i) => i.id === action.id ? { ...i, qty: action.qty } : i) };
    case 'CLEAR':
      return { items: [], tableNumber: '' };
    case 'SET_TABLE':
      return { ...state, tableNumber: action.tableNumber };
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, { items: [], tableNumber: '' });

  const total = state.items.reduce((sum, i) => {
    const price = i.discount_percent ? i.price * (1 - i.discount_percent / 100) : i.price;
    return sum + price * i.qty;
  }, 0);

  const itemCount = state.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items: state.items,
      tableNumber: state.tableNumber,
      total,
      itemCount,
      add: (item) => dispatch({ type: 'ADD', item }),
      remove: (id) => dispatch({ type: 'REMOVE', id }),
      updateQty: (id, qty) => dispatch({ type: 'UPDATE_QTY', id, qty }),
      clear: () => dispatch({ type: 'CLEAR' }),
      setTable: (tableNumber) => dispatch({ type: 'SET_TABLE', tableNumber }),
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
