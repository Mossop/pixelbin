import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route } from "react-router-dom";

const Index = () => {
  return <p>Hello.</p>;
};

ReactDOM.render(
  <BrowserRouter basename="/app">
    <Route exact path="/" component={Index}/>
  </BrowserRouter>,
  document.getElementById("app")
);
