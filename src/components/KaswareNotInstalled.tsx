import { FC } from "react";

export const KaswareNotInstalled: FC = () => {
  return (
    <div className="error">
      KasWare Wallet is not installed. Please install it from{" "}
      <a href="https://kasware.xyz" target="_blank">
        kasware.xyz
      </a>
    </div>
  );
};
