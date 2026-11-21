-- Whether a category appears in the storefront's top menu (header and phone
-- menu). Separate from is_active, which controls whether the category is
-- shown in the store at all (its page and the home page tiles).
--
-- New categories start out of the menu, so it never grows by surprise.
-- Categories that already exist keep their place, because until now every
-- visible category was in the menu.

alter table public.categories
  add column show_in_menu boolean not null default false;

update public.categories set show_in_menu = true;
