import React from "react";

export default function Footer() {
  return (
    <footer className="w-full bg-gray-100 border-t mt-8 py-4 text-center text-sm text-gray-600">
      <p>
        © {new Date().getFullYear()}{" "}
        <strong>OneDeo Leela Facade Systems Pvt. Ltd.</strong>. All rights reserved.
      </p>
      <p className="mt-1">
        Created by{" "}
        <span className="font-medium text-sky-600">Alisha Inamdar</span>
      </p>
    </footer>
  );
}
