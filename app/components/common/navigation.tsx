
import { Link } from "@remix-run/react";

export const Navigation: React.FC = () => {
  return (
    <nav className="bg-muted/20 py-3 px-6 mb-6">
      <div className="max-w-screen-xl mx-auto flex gap-6">
        <Link 
          to="/search"
          className="text-foreground hover:text-primary transition-colors"
        >
          Search
        </Link>
        <Link 
          to="/abilities-list"
          className="text-foreground hover:text-primary transition-colors"
        >
          Abilities List
        </Link>
      </div>
    </nav>
  );
}
