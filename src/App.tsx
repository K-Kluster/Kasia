import { OneLiner } from "./OneLiner";
import { TestWallet } from "./TestWallet";

const test = true;

function App() {
  return <>{test ? <TestWallet /> : <OneLiner />}</>;
}

export default App;
