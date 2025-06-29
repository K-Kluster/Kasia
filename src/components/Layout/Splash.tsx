// WARNING: this file CANNOT use any imports from the app code, it must be a standalone file
import { FC } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

export const SplashScreen: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6">
      <img src="/kasia-logo.png" alt="Kasia Logo" className="w-32 h-32" />
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center text-4xl font-bold mt-4">
          Kasia: Encrypted Messaging Platform
        </h1>
        <p className="text-lg mt-2">Freedom at your fingertips.</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <ArrowPathIcon className="animate-spin h-8 w-8 text-kas-primary" />
        Loading Kasia SDKs...
      </div>
    </div>
  );
};
