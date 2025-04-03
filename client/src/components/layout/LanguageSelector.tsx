import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

export default function LanguageSelector() {
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleLanguageChange = (lang: "en" | "fr") => {
    changeLanguage(lang);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground flex items-center">
          <span>{language.toUpperCase()}</span>
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleLanguageChange("fr")} className="flex justify-between">
          FR {language === "fr" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLanguageChange("en")} className="flex justify-between">
          EN {language === "en" && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
