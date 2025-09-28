import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SEO } from "@/components/common/SEO";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Page Not Found - DataKit"
        description="The requested page could not be found"
      />

      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-muted-foreground mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
          <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
          
          <Button  variant="ghost" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </div>
    </>
  );
};

export default NotFound;