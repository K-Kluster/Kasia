import { OneLiner } from "./OneLiner";
import { TestWallet } from "./TestWallet";

const test = false;

function App() {
  return <>{test ? <TestWallet /> : <OneLiner />}</>;
}

export default App;
