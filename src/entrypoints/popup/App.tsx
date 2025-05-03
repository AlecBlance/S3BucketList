import { DataTable } from "@/components/buckets/data-table";
import { Payment, columns } from "@/components/buckets/columns";

async function getData(): Promise<Payment[]> {
  // Fetch data from your API here.
  return [
    {
      id: "728ed52f",
      amount: 100,
      status: "pending",
      email: "m@example.com",
    },
    // ...
  ];
}

function App() {
  const [data, setData] = useState<Payment[]>([]);

  useEffect(() => {
    const test = async () => {
      const data = await getData();
      setData(data);
    };
    test();
  }, []);

  return (
    <div>
      <DataTable columns={columns} data={data} />
    </div>
  );
}

export default App;
