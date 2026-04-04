import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Shield, Code, ArrowRight } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold">ABANCOOL SMS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button className="gradient-primary">Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 lg:py-32 text-center">
        <div className="max-w-3xl mx-auto animate-fade-in">
          <h1 className="text-4xl lg:text-6xl font-display font-bold leading-tight">
            Bulk SMS Platform{" "}
            <span className="gradient-text">Built for Scale</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Send thousands of SMS messages instantly. Developer-friendly APIs, real-time delivery tracking, and competitive pricing.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gradient-primary">
                Start Sending <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Zap, title: "Lightning Fast", desc: "Queue-based sending with real-time delivery tracking and instant feedback." },
            { icon: Shield, title: "Enterprise Security", desc: "API key authentication, rate limiting, and end-to-end encryption." },
            { icon: Code, title: "Developer API", desc: "RESTful API with comprehensive docs. Integrate SMS in minutes." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-xl p-6 text-center">
              <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-4">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 pb-20">
        <h2 className="text-3xl font-display font-bold text-center mb-10">Simple, Transparent Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { name: "Starter", price: "0.50", desc: "Per SMS segment", features: ["Pay as you go", "Default sender ID", "Dashboard access", "API access"] },
            { name: "Business", price: "0.40", desc: "Per SMS segment (10K+)", features: ["Volume discounts", "Custom sender IDs", "Priority support", "Delivery reports"], popular: true },
            { name: "Enterprise", price: "0.35", desc: "Per SMS segment (50K+)", features: ["Dedicated account", "SLA guarantee", "Custom integration", "White-label options"] },
          ].map((plan) => (
            <div key={plan.name} className={`glass rounded-xl p-6 ${plan.popular ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
              {plan.popular && <p className="text-xs font-medium text-primary mb-2">MOST POPULAR</p>}
              <h3 className="font-display font-bold text-xl">{plan.name}</h3>
              <p className="text-3xl font-display font-bold mt-2">KES {plan.price}</p>
              <p className="text-sm text-muted-foreground">{plan.desc}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="text-success">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link to="/register" className="block mt-6">
                <Button className={`w-full ${plan.popular ? "gradient-primary" : ""}`} variant={plan.popular ? "default" : "outline"}>
                  Get Started
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ABANCOOL TECHNOLOGY. Built for Kenya 🇰🇪
        </div>
      </footer>
    </div>
  );
}
