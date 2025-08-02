import { Button } from "../Common/Button";

type UnlockedProps = {
  onBack: () => void;
};

export const Unlocked = ({ onBack }: UnlockedProps) => {
  return (
    <>
      <h2 className="text-center text-lg font-bold">Wallet Unlocked</h2>
      <div className="mt-5 flex justify-center">
        <Button
          onClick={onBack}
          variant="primary"
          className="w-full px-4 py-2 text-sm"
        >
          Back to Wallets
        </Button>
      </div>
    </>
  );
};
