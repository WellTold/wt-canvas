import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Upload, User } from "lucide-react";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  avatarUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  defaultTheme: z.enum(["light", "dark"]),
  backgroundColor: z.string().optional(),
});

const backgroundColors = [
  { name: "Cream", value: "#f0ebe7", class: "bg-[#f0ebe7]" },
  { name: "Light Red", value: "#f4d4d4", class: "bg-[#f4d4d4]" },
  { name: "Soft Red", value: "#e8b8b8", class: "bg-[#e8b8b8]" },
  { name: "Light Green", value: "#d4f4d4", class: "bg-[#d4f4d4]" },
  { name: "Sage Green", value: "#c8e6c8", class: "bg-[#c8e6c8]" },
  { name: "Light Blue", value: "#d4e4f4", class: "bg-[#d4e4f4]" },
  { name: "Powder Blue", value: "#c8d8e8", class: "bg-[#c8d8e8]" },
  { name: "Lavender", value: "#e4d4f4", class: "bg-[#e4d4f4]" },
  { name: "Peach", value: "#f4e4d4", class: "bg-[#f4e4d4]" },
  { name: "Light Yellow", value: "#f4f4d4", class: "bg-[#f4f4d4]" },
  { name: "Light Gray", value: "#e8e8e8", class: "bg-[#e8e8e8]" },
  { name: "Warm Gray", value: "#e4e0dc", class: "bg-[#e4e0dc]" },
];

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const { data: user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || user?.name || "",
      firstName: user?.firstName || user?.name?.split(" ")[0] || "",
      lastName: user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "",
      email: user?.email || "",
      avatarUrl: user?.avatarUrl || "",
      defaultTheme: user?.defaultTheme || "light",
      backgroundColor: user?.backgroundColor || "#f0ebe7",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PATCH", "/api/profile", data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/auth/me"], updatedUser);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleAvatarUrlChange = (url: string) => {
    form.setValue("avatarUrl", url);
    setAvatarPreview(url);
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your personal information and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your personal details and how others see you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={avatarPreview || user?.avatarUrl} alt={user?.name} />
                    <AvatarFallback className="text-lg font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatarUrl">Profile Picture URL</Label>
                  <FormField
                    control={form.control}
                    name="avatarUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://example.com/avatar.jpg"
                            onChange={(e) => {
                              field.onChange(e);
                              handleAvatarUrlChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter a URL for your profile picture
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Display Name */}
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="How your name appears to others" />
                    </FormControl>
                    <FormDescription>
                      This is the name that will be displayed throughout the application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* First Name */}
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Last Name */}
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormDescription>
                      Your email address for login and notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Background Color */}
              <FormField
                control={form.control}
                name="backgroundColor"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Background Color</FormLabel>
                    <FormDescription>
                      Choose your preferred background color for cards and components
                    </FormDescription>
                    <FormControl>
                      <div className="grid grid-cols-4 gap-3">
                        {backgroundColors.map((color) => (
                          <div
                            key={color.value}
                            className={`w-full h-12 border-2 cursor-pointer transition-all hover:scale-105 ${
                              color.class
                            } ${
                              field.value === color.value
                                ? "border-black shadow-lg"
                                : "border-gray-300"
                            }`}
                            onClick={() => field.onChange(color.value)}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Default Theme */}
              <FormField
                control={form.control}
                name="defaultTheme"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Default Screen Mode</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="light" id="light" />
                          <Label htmlFor="light">Light Mode</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="dark" id="dark" />
                          <Label htmlFor="dark">Dark Mode</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Choose your preferred default theme for the application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Saving Changes..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}