// WARNING: this file CANNOT use any imports from the app code, it must be a standalone file

export const createSplashScreen = (): HTMLElement => {
  const container = document.createElement("div");
  container.className =
    "flex h-screen flex-col items-center justify-center gap-6 p-4 sm:p-0";

  const logo = document.createElement("img");
  logo.src = "/kasia-logo.png";
  logo.alt = "Kasia Logo";
  logo.className = "h-40 w-40";
  logo.loading = "eager";
  logo.decoding = "sync";

  const contentContainer = document.createElement("div");
  contentContainer.className = "flex flex-col items-center gap-4";

  const title = document.createElement("h1");
  title.className = "mt-4 text-center text-4xl font-bold";
  title.textContent = "Kasia: Encrypted Messaging Platform";

  const description = document.createElement("p");
  description.className = "mt-2 text-lg";
  description.textContent = "Freedom at your fingertips.";

  const loadingContainer = document.createElement("div");
  loadingContainer.className = "mt-4 flex items-center gap-2";

  const spinner = document.createElement("div");
  spinner.className =
    "text-kas-primary h-8 w-8 animate-spin border-2 border-current border-t-transparent rounded-full";

  const loadingText = document.createTextNode("Loading Kasia SDKs...");

  contentContainer.appendChild(title);
  contentContainer.appendChild(description);

  loadingContainer.appendChild(spinner);
  loadingContainer.appendChild(loadingText);

  container.appendChild(logo);
  container.appendChild(contentContainer);
  container.appendChild(loadingContainer);

  return container;
};

export const mountSplashScreen = (targetElement: HTMLElement): HTMLElement => {
  const splashElement = createSplashScreen();
  targetElement.appendChild(splashElement);
  return splashElement;
};

export const unmountSplashScreen = (
  splashElement: HTMLElement | null
): void => {
  if (splashElement && splashElement.parentNode) {
    splashElement.parentNode.removeChild(splashElement);
  }
};
