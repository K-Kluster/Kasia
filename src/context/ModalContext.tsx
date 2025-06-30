import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  FC,
} from "react";

export type ModalType =
  | "address"
  | "walletInfo"
  | "withdraw"
  | "backup"
  | "delete"
  | "seed"
  | "warn-costy-send-message" // confirm modals should be handled generically
  | "utxo-compound";

interface ModalContextValue {
  openModal: (m: ModalType) => void;
  closeModal: (m: ModalType) => void;
  closeAllModals: () => void;
  isOpen: (m: ModalType) => boolean;
}

const ModalContext = createContext<ModalContextValue>(null!);

export const ModalProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<Partial<Record<ModalType, boolean>>>({});

  const openModal = (m: ModalType) => setState((s) => ({ ...s, [m]: true }));
  const closeModal = (m: ModalType) => setState((s) => ({ ...s, [m]: false }));
  const isOpen = (m: ModalType) => !!state[m];
  const closeAllModals = () => setState({});

  return (
    <ModalContext.Provider
      value={{ openModal, closeModal, isOpen, closeAllModals }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModals = () => useContext(ModalContext);
