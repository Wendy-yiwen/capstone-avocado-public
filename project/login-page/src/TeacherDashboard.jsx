import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from './assets/Logo.png'
import { Menu, MenuButton, MenuItem, MenuItems, } from '@headlessui/react'
import { Bars3Icon, CalendarIcon, HomeIcon, UsersIcon, } from '@heroicons/react/24/outline'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { BsChatDots, BsPersonPlus, BsArrowLeftCircle } from 'react-icons/bs';
import TopBar from './components/TopBar'
import { Outlet } from 'react-router-dom';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Example() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  const username = user?.name || 'User';
  const isChatPage = location.pathname.startsWith('/Channel');
  const [selectedCourse, setSelectedCourse] = useState('Course');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/teacher/TeacherHome', icon: HomeIcon },
    { name: 'Assignment', href: '/teacher/Assignment', icon: CalendarIcon },
    { name: 'Group', href: '/teacher/Group', icon: BsArrowLeftCircle },
  ]
  const userNavigation = [
    { name: 'Your profile', href: '#' },
    { name: 'Sign out', action: handleLogout },
  ]
  return (
    <>
      <div>
        {/* Static sidebar for desktop */}
        <div className="fixed inset-y-0 z-50 flex w-72 flex-col">
          {/* Sidebar component, swap this element with another sidebar if you like */}
          <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-indigo-600 px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <img
                alt="img"
                src={logo}
                className="h-9 w-auto"
              />
            </div>
            <nav className="flex flex-2 flex-col -mx-4">
              <ul className="flex flex-1 flex-col gap-y-7 -mx-10 w-full">
                <li>
                  <ul className="-mx-4 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          className={classNames(
                            location.pathname === item.href
                              ? 'bg-indigo-700 text-white'
                              : 'text-indigo-200 hover:bg-indigo-700 hover:text-white',
                            'group flex gap-x-3 w-[255px] rounded-md p-3 text-xl font-semibold  no-underline',
                          )}
                        >
                          <item.icon
                            aria-hidden="true"
                            className={classNames(
                              item.current ? 'text-white' : 'text-indigo-200 group-hover:text-white',
                              'size-6 shrink-0',
                            )}
                          />
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="lg:pl-72">
          {!isChatPage && (
            <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
              {/* Separator */}
              <div aria-hidden="true" className="h-6 w-px bg-gray-900/10 lg:hidden" />
              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <div className="ml-auto flex items-center gap-x-4 lg:gap-x-3">
                  {/* Separator */}
                  <TopBar />
                  <div aria-hidden="true" className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" />

                  {/* Profile dropdown */}
                  <Menu as="div" className="relative">
                    <MenuButton className="-m-1.5 flex items-center p-1.5">
                      <span className="flex items-center">
                        <span aria-hidden="true" className="ml-4 text-lg font-semibold text-gray-900">
                          {username || 'User'}
                        </span>
                        <ChevronDownIcon aria-hidden="true" className="ml-2 size-5 text-gray-400" />
                      </span>
                    </MenuButton>
                    <MenuItems
                      transition
                      className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in  no-underline"
                    >
                      {userNavigation.map((item) => (
                        <MenuItem key={item.name}>
                          {({ active }) =>
                            <button
                              onClick={item.action}
                              className={classNames(
                                active ? 'bg-gray-100' : '',
                                'w-full px-4 py-2 text-left text-sm text-gray-900'
                              )}
                            >
                              {item.name}
                            </button>
                          }
                        </MenuItem>
                      ))}
                    </MenuItems>
                  </Menu>
                </div>
              </div>
              <main className="py-10">
                <div className="px-4 sm:px-6 lg:px-8"><Outlet /></div>
              </main>
            </div>

          )}
        </div>
      </div>
    </>
  )
}
