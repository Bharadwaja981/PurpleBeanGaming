import * as React from "react";import {cn} from "@/lib/utils";
export function Button({className,variant="primary",...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:"primary"|"secondary"|"danger"}){return <button className={cn("button",variant==="primary"&&"button-primary",variant==="secondary"&&"button-secondary",variant==="danger"&&"button-danger",className)} {...props}/>}
