import { CiSettings } from "react-icons/ci";

const Footer = () => {
  return (
    <div className="bg-secondary flex items-center justify-between p-2">
      <div className="flex space-x-1">
        {/* <CiSettings className="text-xl text-white" /> */}
      </div>
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
