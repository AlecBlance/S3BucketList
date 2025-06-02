import { CiSettings } from "react-icons/ci";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TabOnly from "./TabOnly";

const Settings = () => {
  return (
    <Sheet>
      <SheetTrigger className="flex space-x-1">
        <CiSettings className="cursor-pointer text-xl text-white" />
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-lg">Settings</SheetTitle>
          <SheetDescription>
            <TabOnly />
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};

export default Settings;
