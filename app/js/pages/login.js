import React from "react";

const LoginPage = () => {
  return (
    <div id="content" className="centerblock">
      <form id="loginForm" className="fieldGrid">
        <p style={{ gridColumn: "span 2", justifySelf: "start" }}>Please enter your login details:</p>
        <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
        <input type="email" id="email"/>
        <p className="rightAlign"><label htmlFor="password">Password:</label></p>
        <input type="password" id="password"/>
        <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input type="submit" value="Log In"/></p>
      </form>
    </div>
  );
};

export default LoginPage;
