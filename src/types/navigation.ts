export interface NavLink {
  label: string;
  href: string;
  /** When true, only match the path exactly (no prefix matching). */
  exact?: boolean;
}

export interface UserMenuItemDef {
  label: string;
  href: string;
}

export interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export interface MobileMenuProps {
  links: NavLink[];
  isOpen: boolean;
  onClose: () => void;
}
