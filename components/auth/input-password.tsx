"use client";

import { FaRegEye } from "react-icons/fa";
import { Input } from "../input";
import React, { useState } from "react";

const InputPassword = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ ...props }, ref) => {
  const [visible, setVisible] = useState<boolean>(false);

  return (
    <div className="relative">
      <Input
        placeholder="Password"
        type={visible ? "text" : "password"}
        ref={ref}
        {...props}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <FaRegEye
          className="cursor-pointer"
          onMouseDown={() => setVisible(true)}
          onMouseUp={() => setVisible(false)}
          onMouseLeave={() => setVisible(false)}
        />
      </div>
    </div>
  );
});
InputPassword.displayName = "InputPassword";
export default InputPassword;
