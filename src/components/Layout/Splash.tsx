// WARNING: this file CANNOT use any imports from the app code, it must be a standalone file
import { FC } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

export const SplashScreen: FC = () => {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-4 sm:p-0">
      <img src="/kasia-logo.png" alt="Kasia Logo" className="h-40 w-40" />
      <div className="flex flex-col items-center gap-4">
        <h1 className="mt-4 text-center text-4xl font-bold">
          Kasia: Encrypted Messaging Platform
        </h1>
        <p className="mt-2 text-lg">Freedom at your fingertips.</p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <ArrowPathIcon className="text-kas-primary h-8 w-8 animate-spin" />
        Loading Kasia SDKs...
      </div>
    </div>
  );
};
