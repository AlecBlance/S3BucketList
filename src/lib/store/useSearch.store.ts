import { create } from "zustand";

interface IUseSearch {
  query: string;
  setQuery: (query: string) => void;
}

const useSearch = create<IUseSearch>((set) => ({
  query: "",
  setQuery: (query: string) => set({ query }),
}));

export default useSearch;
