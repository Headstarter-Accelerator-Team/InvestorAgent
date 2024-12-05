"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";



export default function SearchForm() {
    const [query, setQuery] = useState('');

    return (<form>
        <div className="flex gap-2">
            <Input 
                type="text"
                placeholder="Enter your research query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit">Search</Button>
        </div>
    </form>);
}