import Header from "@/components/sections/header";
import Footer from "@/components/sections/footer";
import Body from "@/components/sections/body";

function App() {
  return (
    <div className="flex grow flex-col">
      <Header />
      <Body />
      <Footer />
    </div>
  );
}

export default App;
