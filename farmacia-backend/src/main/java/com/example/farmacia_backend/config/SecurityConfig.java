package com.example.farmacia_backend.config;

import com.example.farmacia_backend.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@EnableMethodSecurity
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http,
                                    JwtAuthFilter jwtAuthFilter,
                                    AuthenticationEntryPoint authEntryPoint,
                                    AccessDeniedHandler accessDeniedHandler) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // CORRECCIÓN #2: Una sola regla /api/auth/** cubre login
                        // Y password-reset (que corregimos a /api/auth/password-reset/**).
                        // La línea vieja /auth/password-reset/** fue eliminada.
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/error").permitAll()

                        // Gestión de usuarios → solo SUPER_ADMIN
                        .requestMatchers("/api/users/**").hasRole("SUPER_ADMIN")

                        // Especialistas → SUPER_ADMIN, ADMIN y el propio ESPECIALISTA
                        // La validación fina de "su propio perfil" la hace @PreAuthorize
                        // en EspecialistaController con authentication.principal.idUsuario
                        .requestMatchers("/api/especialistas/**")
                            .hasAnyRole("SUPER_ADMIN", "ADMIN", "ESPECIALISTA")

                        // Pacientes y servicios
                        .requestMatchers("/api/pacientes/**")
                            .hasAnyRole("SUPER_ADMIN", "ADMIN", "ESPECIALISTA")
                        .requestMatchers("/api/servicios/**")
                            .hasAnyRole("SUPER_ADMIN", "ADMIN", "ESPECIALISTA")

                        // Citas y notificaciones
                        .requestMatchers("/api/citas/**")
                            .hasAnyRole("SUPER_ADMIN", "ADMIN", "ESPECIALISTA", "SECRETARIA")
                        .requestMatchers("/api/notifications/**")
                            .hasAnyRole("SUPER_ADMIN", "ADMIN", "ESPECIALISTA", "SECRETARIA")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}