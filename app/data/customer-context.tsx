import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { HttpTypes } from '@medusajs/types';
import apiClient from '@api/client';
import { useCart } from './cart-context';

type CustomerContextType = {
  customer?: HttpTypes.StoreCustomer;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  refreshCustomer: () => Promise<void>;
  updateCustomer: (customer: HttpTypes.StoreUpdateCustomer) => Promise<void>;
};

const CustomerContext = createContext<CustomerContextType | null>(null);

type CustomerProviderProps = {
  children: React.ReactNode;
};

export const CustomerProvider = ({ children }: CustomerProviderProps) => {
  const [customer, setCustomer] = useState<HttpTypes.StoreCustomer>();
  const { linkCartToCustomer, resetCart } = useCart();

  const refreshCustomer = useCallback(async () => {
    try {
      const { customer: existingCustomer } =
        await apiClient.store.customer.retrieve();
      setCustomer(existingCustomer);
    } catch {
      setCustomer(undefined);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.auth.login('customer', 'emailpass', {
        email,
        password,
      });

      if (typeof response === 'string') {
        await Promise.all([refreshCustomer(), linkCartToCustomer()]);
      } else {
        console.log('Third party auth', response);
      }
    },
    [refreshCustomer, linkCartToCustomer],
  );

  const logout = useCallback(async () => {
    await apiClient.auth.logout();
    await resetCart();
    setCustomer(undefined);
  }, [resetCart]);

  const register = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ) => {
      const token = await apiClient.auth.register('customer', 'emailpass', {
        email,
        password,
      });

      await apiClient.client.setToken(token);

      await apiClient.store.customer.create({
        first_name: firstName,
        last_name: lastName,
        email,
      });
      await login(email, password);
    },
    [login],
  );

  const updateCustomer = useCallback(
    async (data: HttpTypes.StoreUpdateCustomer) => {
      const response = await apiClient.store.customer.update(data);
      setCustomer(response.customer);
    },
    [],
  );

  const value = useMemo<CustomerContextType>(
    () => ({
      customer,
      login,
      logout,
      register,
      refreshCustomer,
      updateCustomer,
    }),
    [customer, login, logout, register, refreshCustomer, updateCustomer],
  );

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);

  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }

  return context;
};
