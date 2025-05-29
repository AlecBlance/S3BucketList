import { Input } from "@/components/ui/input";
import useSearch from "@/lib/store/useSearch.store";

const Search = () => {
  const { setQuery } = useSearch((state) => state);

  return (
    <div>
      <Input
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="text-sm"
      />
    </div>
  );
};

export default Search;
