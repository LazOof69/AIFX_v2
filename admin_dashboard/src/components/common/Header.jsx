const Header = ({ title }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
    </header>
  );
};

export default Header;
