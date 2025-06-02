import { CiSettings } from "react-icons/ci";
import Settings from "./Settings/Settings";

const Footer = () => {
  return (
    <div className="bg-secondary flex items-center justify-between p-2">
      <Settings />
      <p>
        Made with ❤️ by{" "}
        <a
          href="https://alecblance.com"
          className="decoration-primary hover:text-primary underline decoration-2 underline-offset-2"
        >
          Alec Blance
        </a>
      </p>
    </div>
  );
};

export default Footer;
