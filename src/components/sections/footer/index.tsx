import Settings from "./Settings/Settings";

const Footer = () => {
  return (
    <div className="bg-secondary flex items-center justify-between p-2">
      <div className="flex items-center gap-4">
        <Settings />
        <a
          href="https://github.com/AlecBlance/S3BucketList/issues"
          target="_blank"
          className="decoration-primary hover:underline"
        >
          ❓ Help
        </a>
        <a
          href="https://chromewebstore.google.com/detail/s3bucketlist/anngjobjhcbancaaogmlcffohpmcniki/reviews"
          target="_blank"
          className="decoration-primary hover:underline"
        >
          ⭐ Rate
        </a>
      </div>
      <p>
        Made with ❤️ by{" "}
        <a
          href="https://alecblance.com"
          target="_blank"
          className="decoration-primary hover:text-primary underline decoration-2 underline-offset-2"
        >
          Alec Blance
        </a>
      </p>
    </div>
  );
};

export default Footer;
