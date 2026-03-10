import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  Compass,
  SlidersHorizontal,
  Mail,
  Shield,
  Clock,
  Sparkles,
  Building2,
  FileText,
  Code2,
  ExternalLink,
} from "lucide-react";

const crisisCards = [
  {
    title: "SEO Manipulation",
    stat: "$80B",
    body: "Wasted annually on gaming search results for third-party profit instead of better information.",
  },
  {
    title: "Echo Chambers",
    stat: "85%",
    body: "Of users never look beyond page 1, missing diverse perspectives that ranking systems suppress.",
  },
  {
    title: "Algorithm Bias",
    stat: "∞",
    body: "Search results become homogenized over time, promoting conformity over discovery.",
  },
];

const solutionCards = [
  {
    title: "Auto-Generated Insights",
    body: "Pulls results from pages 2-10 and combines signals from multiple engines for broader perspectives.",
    icon: Sparkles,
  },
  {
    title: "SEO Bypass",
    body: "Skips first-page bias to surface information that has not been optimized primarily for ranking games.",
    icon: SlidersHorizontal,
  },
  {
    title: "Email Integration",
    body: "Designed to fit HopMail-style workflows so research can happen contextually from conversations.",
    icon: Mail,
  },
  {
    title: "Anti-Echo Chamber",
    body: "Breaks filter bubbles by emphasizing cross-engine overlap and hidden results.",
    icon: Compass,
  },
  {
    title: "Time Savings",
    body: "Automates deep-page review so you avoid repetitive query tweaking and manual result sifting.",
    icon: Clock,
  },
  {
    title: "Privacy First",
    body: "Built around unbiased information access with no user profiling in ranking decisions.",
    icon: Shield,
  },
];

const ecosystemCards = [
  {
    title: "HopMail",
    body: "Email platform with modern protocols, native AI support, and workflow automation.",
  },
  {
    title: "SecondPage.ai",
    body: "Search aggregation beyond page 1 to surface higher-variance and less-manipulated information.",
  },
  {
    title: "Identity Platform",
    body: "Blockchain-based identity infrastructure with AI optimization features (planned).",
  },
];

const resourceCards = [
  {
    title: "Pitch Deck",
    body: "Presentation on search manipulation, market dynamics, and the product ecosystem.",
    cta: "View Pitch Deck",
    icon: Building2,
    href: "#",
  },
  {
    title: "Project Overview",
    body: "Technical architecture and implementation approach for the broader platform.",
    cta: "Read Overview",
    icon: FileText,
    href: "#",
  },
  {
    title: "Source Code",
    body: "Open components and implementation details that power search aggregation and ranking.",
    cta: "View Code",
    icon: Code2,
    href: "#",
  },
];

export default function About() {
  return (
    <div className="min-h-screen relative" style={{ background: "linear-gradient(135deg, #0f1629 0%, #1a1f3a 50%, #0f1629 100%)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute w-96 h-96 rounded-full blur-3xl" style={{ background: "#dc354520", top: "8%", right: "14%" }} />
        <div className="absolute w-96 h-96 rounded-full blur-3xl" style={{ background: "#3b82f620", bottom: "12%", left: "10%" }} />
      </div>

      <header className="relative border-b border-white/10 backdrop-blur-md sticky top-0 z-20" style={{ background: "#0f162990" }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <a className="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded" style={{ border: "2px solid #dc3545", borderBottomColor: "transparent", borderLeftColor: "#3b5fc7" }} />
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-lg font-semibold">secondpage.ai</span>
              </a>
            </Link>

            <Link href="/">
              <Button variant="outline" size="sm" className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-8 max-w-6xl text-white">
        <section className="text-center py-10 md:py-14">
          <Badge className="mb-4 bg-red-500/20 text-red-100 border border-red-400/30 hover:bg-red-500/20">
            Break Free from Algorithmic Manipulation
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About <span style={{ color: "#dc3545" }}>SecondPage.ai</span>
          </h1>
          <p className="text-white/65 max-w-3xl mx-auto text-lg">
            Auto-generate search results from page 2+ to get broader perspectives and bypass SEO-driven result shaping.
          </p>
          <p className="text-red-200 mt-4 font-medium">Because the best information is often hidden beyond page 1.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-7">
            <a href="mailto:research@secondpage.ai">
              <Button className="bg-[#dc3545] hover:bg-[#c12e3d] text-white">
                <Mail className="h-4 w-4 mr-2" />
                Try via Email
              </Button>
            </a>
            <Link href="/">
              <Button variant="outline" className="bg-transparent border-white/25 text-white/85 hover:bg-white/10">
                <Search className="h-4 w-4 mr-2" />
                Open Search
              </Button>
            </Link>
          </div>
        </section>

        <section className="mb-10">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold">The Information Crisis</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {crisisCards.map((card) => (
              <Card key={card.title} className="border-white/15 bg-white/5 backdrop-blur-sm text-white">
                <CardHeader>
                  <CardTitle className="text-white">{card.title}</CardTitle>
                  <div className="text-4xl font-bold" style={{ color: "#ff8f9a" }}>{card.stat}</div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-white/70">{card.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-white/80 mt-6 text-lg">
            <strong>The truth:</strong> page 2+ often holds the perspectives most people never see.
          </p>
        </section>

        <section className="mb-10">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold">The SecondPage.ai Solution</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {solutionCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-white/15 bg-blue-500/10 backdrop-blur-sm text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Icon className="h-5 w-5" style={{ color: "#93c5fd" }} />
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-white/70">{card.body}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-10">
          <Card className="border-white/15 bg-white/5 backdrop-blur-sm text-white">
            <CardHeader>
              <CardTitle className="text-3xl text-center">Zero Shot Labs Ecosystem</CardTitle>
              <CardDescription className="text-center text-white/70 text-base">
                SecondPage.ai is part of a broader information liberation platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {ecosystemCards.map((card) => (
                  <Card key={card.title} className="border-red-300/20 bg-white/10 text-white">
                    <CardHeader>
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-white/70">{card.body}</CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="rounded-xl p-6 text-center" style={{ background: "linear-gradient(135deg, #dc3545cc, #3b5fc7cc)" }}>
                <h3 className="text-xl font-semibold mb-2">Mission: Information Liberation</h3>
                <p className="text-white/90">
                  Reduce algorithmic manipulation across communication, search, and identity.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold">Resources</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {resourceCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-white/15 bg-white/5 backdrop-blur-sm text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" style={{ color: "#fca5a5" }} />
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CardDescription className="text-white/70">{card.body}</CardDescription>
                    <a href={card.href}>
                      <Button variant="outline" size="sm" className="bg-transparent border-white/25 text-white/85 hover:bg-white/10">
                        {card.cta}
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <Card className="border-white/15 bg-white/5 backdrop-blur-sm text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-2 text-white/75">
              <a className="hover:text-white" href="mailto:research@secondpage.ai">research@secondpage.ai</a>
              <a className="hover:text-white" href="mailto:info@secondpage.ai">info@secondpage.ai</a>
              <a className="hover:text-white" href="mailto:investors@secondpage.ai">investors@secondpage.ai</a>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="relative border-t border-white/10 py-8 text-center text-sm text-white/50">
        <div className="container mx-auto px-4">© 2026 Zero Shot Labs. Breaking free from algorithmic manipulation.</div>
      </footer>
    </div>
  );
}
