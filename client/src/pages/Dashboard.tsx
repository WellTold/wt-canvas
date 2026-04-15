import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Magnet, 
  Rocket, 
  Image, 
  Palette,
  PlusCircle,
  BarChart3,
  Clock,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import logoSquare from "@assets/wt-canvas-square-logo.png";

export default function Dashboard() {
  const { data: user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'User';

  const contentTypes = [
    {
      title: "Blog Articles",
      description: "Create search-optimized blog posts that drive traffic and engage readers",
      icon: FileText,
      href: "/blog-articles",
      color: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Lead Magnets",
      description: "Build high-converting landing pages to capture leads and grow your audience",
      icon: Magnet,
      href: "/lead-magnets",
      color: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
      iconColor: "text-yellow-600 dark:text-yellow-400"
    },
    {
      title: "Landing Pages",
      description: "Design compelling landing pages that convert specific targeted visitors into customers",
      icon: Rocket,
      href: "/landing-pages",
      color: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
      iconColor: "text-green-600 dark:text-green-400"
    }
  ];

  const mediaTypes = [
    {
      title: "Brand Logos",
      description: "Organize and manage your brand assets and logo variations",
      icon: Palette,
      href: "/brand-logos",
      color: "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    {
      title: "Lifestyle Images",
      description: "Curate lifestyle photography for your marketing campaigns",
      icon: Image,
      href: "/lifestyle-images",
      color: "bg-pink-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800",
      iconColor: "text-pink-600 dark:text-pink-400"
    }
  ];

  const quickActions = [
    {
      title: "Create New Content",
      description: "Start a new blog post, lead magnet, or landing page",
      icon: PlusCircle,
      action: "Create",
      items: [
        { name: "Blog Article", href: "/blog-articles/new" },
        { name: "Lead Magnet", href: "/lead-magnets/new" },
        { name: "Landing Page", href: "/landing-pages/new" }
      ]
    },
    {
      title: "Content Overview",
      description: "View all your content across different stages",
      icon: BarChart3,
      items: [
        { name: "Draft Items", count: 12 },
        { name: "In Review", count: 3 },
        { name: "Approved", count: 8 },
        { name: "Published", count: 24 }
      ]
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center py-8">
        <div className="mb-6">
          <img src={logoSquare} alt="WT Canvas Logo" className="w-16 h-16 mx-auto" />
        </div>
        <h1 className="font-bold text-gray-900 dark:text-white mb-4">
          Welcome to WT Canvas, {firstName}!
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Your comprehensive content creation dashboard. Build, manage, and publish 
          high-quality content across all your marketing channels with AI-powered tools.
        </p>
      </div>

      {/* Content Creation Cards */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
          Content Creation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contentTypes.map((type) => {
            const getShadowClass = () => {
              if (type.href.includes('blog')) return 'hover-flat-shadow-blue';
              if (type.href.includes('lead')) return 'hover-flat-shadow-green';
              if (type.href.includes('landing')) return 'hover-flat-shadow-purple';
              return 'hover-flat-shadow-blue';
            };
            
            return (
              <Link key={type.title} href={type.href}>
                <Card className={`cursor-pointer ${getShadowClass()} transition-all border border-black`} style={{ backgroundColor: '#f0ebe7' }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-medium">{type.title}</CardTitle>
                      <div style={{ backgroundColor: '#f0ebe7' }}>
                        <type.icon className="h-6 w-6 text-gray-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {type.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Media Management Cards */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
          Media Library
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mediaTypes.map((type) => {
            const getShadowClass = () => {
              if (type.href.includes('brand')) return 'hover-flat-shadow-purple';
              if (type.href.includes('lifestyle')) return 'hover-flat-shadow-green';
              return 'hover-flat-shadow-blue';
            };
            
            return (
              <Link key={type.title} href={type.href}>
                <Card className={`cursor-pointer ${getShadowClass()} transition-all border border-black`} style={{ backgroundColor: '#f0ebe7' }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-medium">{type.title}</CardTitle>
                      <div style={{ backgroundColor: '#f0ebe7' }}>
                        <type.icon className="h-6 w-6 text-gray-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {type.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quickActions.map((action) => (
            <Card key={action.title} className="border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <action.icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {action.items && (
                  <div className="space-y-2">
                    {action.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-sm font-medium">
                          {'href' in item ? (
                            <Link href={item.href}>
                              <a className="text-blue-600 dark:text-blue-400 hover:underline">
                                {item.name}
                              </a>
                            </Link>
                          ) : (
                            item.name
                          )}
                        </span>
                        {'count' in item && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                            {item.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* AI Features Highlight */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl p-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            AI-Powered Content Creation
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Leverage advanced AI tools to generate SEO-optimized titles, compelling meta descriptions, 
            and enhance your content quality automatically.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              AI Title Generation
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              Meta Description Creation
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              Content Enhancement
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              Section Generation
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}