import Header from "@/components/sections/header";
import Footer from "@/components/sections/footer";
import Body from "@/components/sections/body";
import useInitialData from "@/lib/hooks/useInitialData";

function App() {
  // Initialize the data for buckets and last seen date
  useInitialData();

  return (
    <div className="flex grow flex-col">
      <Header />
      <Body />
      <Footer />
    </div>
  );
}

export default App;
